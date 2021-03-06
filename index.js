const IncomingWebhook = require('@slack/client').IncomingWebhook;
const humanizeDuration = require('humanize-duration');
const config = require('./config.json');

module.exports.webhook = new IncomingWebhook(config.SLACK_WEBHOOK_URL);
module.exports.status = config.GC_SLACK_STATUS;

// subscribe is the main function called by GCF.
module.exports.subscribe = (event, callback) => {
  const build = module.exports.eventToBuild(event.data.data);

  // Skip if the current status is not in the status list.
  const status = module.exports.status || [
    'SUCCESS',
    'FAILURE',
    'INTERNAL_ERROR',
    'TIMEOUT',
  ];
  if (status.indexOf(build.status) === -1) {
    return callback();
  }

  // Send message to slack.
  const message = module.exports.createSlackMessage(build);
  module.exports.webhook.send(message, (err, res) => {
    if (err) console.log('Error:', err);
    callback(err);
  });
};

// eventToBuild transforms pubsub event message to a build object.
module.exports.eventToBuild = data => {
  return JSON.parse(new Buffer(data, 'base64').toString());
};

const DEFAULT_COLOR = '#4285F4'; // blue
const STATUS_COLOR = {
  QUEUED: DEFAULT_COLOR,
  WORKING: DEFAULT_COLOR,
  CANCELLED: '#AAAAAA',
  SUCCESS: '#34A853', // green
  FAILURE: '#EA4335', // red
  TIMEOUT: '#FBBC05', // yellow
  INTERNAL_ERROR: '#EA4335', // red
};

// createSlackMessage create a message from a build object.
module.exports.createSlackMessage = build => {
  let images = build.images || [];
  let timestamp = build.finishTime
    ? new Date(build.finishTime)
    : new Date(build.startTime);
  let message = {
    username: 'GCP',
    icon_url:
      'https://ssl.gstatic.com/pantheon/images/containerregistry/container_registry_color.png',
    mrkdwn: true,
    attachments: [
      {
        color: STATUS_COLOR[build.status] || DEFAULT_COLOR,
        author_name: `Build [${build.status}]`,
        author_link: build.logUrl,
        text: `${images[0]}`,
        footer: `${build.source.repoSource.repoName} [${
          build.source.repoSource.branchName
        }]`,
        ts: Math.round(timestamp.getTime() / 1000),
      },
    ],
  };

  return message;
};
