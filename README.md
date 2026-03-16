# Mock Meet Link API

A tiny Express server that generates mock Google Meet links and keeps them in memory.

## Prerequisites

- Node.js (LTS recommended)
- npm

## Install

```bash
npm install
npm install express uuid
```

## Run

```bash
node mock_server/meetlink_generator.js
```

The server listens on `http://localhost:3000`.

## API

### Create a meeting

```bash
curl -X POST http://localhost:3000/api/generate-meet-link \
  -H "Content-Type: application/json" \
  -d '{"title":"Standup","duration":15,"hostName":"Alex"}'
```

```powershell
Invoke-WebRequest -Method Post -Uri http://localhost:3000/api/generate-meet-link `
  -ContentType "application/json" `
  -Body '{"title":"Standup","duration":15,"hostName":"Alex"}'
```

### Slack /meet command

Slack sends slash commands as form-encoded payloads. You can also pass a title
and duration as `title|duration` in the `text` field.

```bash
curl -X POST http://localhost:3000/meet \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "command=/meet&text=Daily standup|15&user_name=Alex&channel_name=general"
```

```powershell
Invoke-WebRequest -Method Post -Uri http://localhost:3000/meet `
  -ContentType "application/x-www-form-urlencoded" `
  -Body "command=/meet&text=Daily standup|15&user_name=Alex&channel_name=general"
```

## Load Test

```bash
npm run loadtest
```

Generate an HTML report from the JSON output:

```bash
npm run report:html
```

Run both in one go:

```bash
npm run loadtest:report
```

### List all meetings

```bash
curl http://localhost:3000/api/meetings
```

### Get a meeting by id

```bash
curl http://localhost:3000/api/meetings/<id>
```

### Delete a meeting by id

```bash
curl -X DELETE http://localhost:3000/api/meetings/<id>
```

## Notes

- Data is stored in memory and resets when the server restarts.
