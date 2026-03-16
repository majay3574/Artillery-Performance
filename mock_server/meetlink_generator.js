const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Mock database to store meeting links
const meetings = [];

function randomLetters(length) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
}

// Generate a Google Meet-style code, e.g. abc-defg-hij
function generateMeetingId() {
  return `${randomLetters(3)}-${randomLetters(4)}-${randomLetters(3)}`;
}

function normalizeDuration(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return 60;
}

function parseSlackText(text) {
  if (!text || typeof text !== 'string') {
    return {};
  }

  const parts = text
    .split('|')
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return {};
  }

  const title = parts[0];
  const duration = parts.length > 1 ? Number.parseInt(parts[1], 10) : undefined;

  return {
    title,
    duration: Number.isFinite(duration) ? duration : undefined
  };
}

function createMeeting({
  title,
  duration,
  hostName,
  source,
  command,
  channel,
  requestedBy
} = {}) {
  const meetingId = generateMeetingId();
  const meetLink = `https://meet.google.com/${meetingId}`;

  const meeting = {
    id: uuidv4(),
    meetingId: meetingId,
    title: title || 'Untitled Meeting',
    hostName: hostName || 'Anonymous',
    duration: normalizeDuration(duration),
    meetLink: meetLink,
    createdAt: new Date().toISOString(),
    isActive: true
  };

  if (source) {
    meeting.source = source;
  }
  if (command) {
    meeting.command = command;
  }
  if (channel) {
    meeting.channel = channel;
  }
  if (requestedBy) {
    meeting.requestedBy = requestedBy;
  }

  meetings.push(meeting);
  return meeting;
}

// Generate meet link endpoint
app.post('/api/generate-meet-link', (req, res) => {
  const { title, duration, hostName } = req.body;

  const meeting = createMeeting({
    title,
    duration,
    hostName,
    source: 'api'
  });

  res.json({
    success: true,
    data: meeting
  });
});

// Slack-style /meet command endpoint
app.post('/meet', (req, res) => {
  const { command, text, user_name, user_id, channel_name, channel_id } = req.body;

  if (command && command !== '/meet') {
    return res.status(400).json({
      response_type: 'ephemeral',
      text: 'Invalid command. Use /meet.'
    });
  }

  const parsed = parseSlackText(text);

  const meeting = createMeeting({
    title: req.body.title || parsed.title,
    duration: req.body.duration || parsed.duration,
    hostName: req.body.hostName || user_name || user_id,
    source: 'slack',
    command: command || '/meet',
    channel: channel_name || channel_id,
    requestedBy: user_name || user_id
  });

  res.json({
    response_type: 'in_channel',
    text: `Meet link for ${meeting.title}: ${meeting.meetLink}`,
    meeting: meeting
  });
});

// Get all meetings
app.get('/api/meetings', (req, res) => {
  res.json({
    success: true,
    data: meetings
  });
});

// Get specific meeting by ID
app.get('/api/meetings/:id', (req, res) => {
  const meeting = meetings.find(m => m.id === req.params.id);

  if (!meeting) {
    return res.status(404).json({
      success: false,
      message: 'Meeting not found'
    });
  }

  res.json({
    success: true,
    data: meeting
  });
});

// Delete meeting
app.delete('/api/meetings/:id', (req, res) => {
  const index = meetings.findIndex(m => m.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: 'Meeting not found'
    });
  }

  meetings.splice(index, 1);

  res.json({
    success: true,
    message: 'Meeting deleted successfully'
  });
});

app.listen(port, () => {
  console.log(`Mock API server running at http://localhost:${port}`);
});
