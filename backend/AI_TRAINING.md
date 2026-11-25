# Boomerr Agent Training Documentation

## Overview
Boomerr Agent automatically analyzes incidents on page load and enables continuous chat with context. The system now includes training data export for fine-tuning the AI agent.

## Features

### 1. Auto-Analysis on Page Load
When you open an incident details page:
- Backend auto-generates AI analysis if not already present
- Only filtered headers are sent to AI (configurable via `.env`)
- Analysis is stored in `ai_summary` field
- Chat history is automatically initialized

### 2. Filtered Header Configuration
Control which headers are sent to AI via `.env`:

```env
BOOMERR_AI_HEADER_FILTER="server,content-type,cf-ray,x-powered-by"
```

Only these headers from the incident response will be included in the AI prompt. This:
- Reduces token usage
- Focuses AI on diagnostic headers
- Improves response quality

### 3. Chat Continuation
- Users can continue chatting after initial analysis
- Full conversation context is maintained
- Chat history persists in `incident_ai_chat` table
- Frontend auto-loads existing chat on page load

### 4. Custom System Prompt
Configure the AI's behavior via `.env`:

```env
BOOMERR_AI_SYSTEM_PROMPT="You are Boomerr Agent, an expert in diagnosing website and domain outages. Analyze incidents thoroughly and provide actionable remediation steps."
```

## Training Data Export

### Generate JSON Training Data
**Endpoint:** `GET /api/ai-training/data?limit=100`

Returns structured JSON with:
- Incident metadata (domain, URL, status)
- Filtered response headers
- Exception details
- AI analysis
- Full chat history
- Resolution timestamp

**Example Response:**
```json
{
  "total": 50,
  "training_data": [
    {
      "incident_id": "01JKRT...",
      "domain": "example.com",
      "url": "https://example.com",
      "http_status": 503,
      "response_headers": {
        "server": "nginx",
        "content-type": "text/html"
      },
      "ai_analysis": "The 503 error indicates...",
      "chat_history": [
        {"role": "ai", "message": "Analysis..."},
        {"role": "user", "message": "What about SSL?"},
        {"role": "ai", "message": "SSL is valid..."}
      ]
    }
  ],
  "metadata": {
    "generated_at": "2026-01-20 12:00:00",
    "system_prompt": "You are Boomerr Agent...",
    "header_filter": "server,content-type,cf-ray,x-powered-by",
    "model": "gpt-4o-mini"
  }
}
```

### Generate Text Training Prompt
**Endpoint:** `GET /api/ai-training/prompt-text?limit=50`

Downloads a formatted text file containing:
- System instructions
- Example incidents with diagnoses
- Formatted for fine-tuning or prompt engineering

**Example Output:**
```
# Boomerr Agent Training Prompt

## System Instructions

You are Boomerr Agent, an expert in diagnosing website and domain outages...

## Example Incidents and Diagnoses

### Example 1

**Domain:** example.com
**URL:** https://example.com
**HTTP Status:** 503
**Exception:** None
**Key Headers:**
{
  "server": "nginx",
  "content-type": "text/html"
}

**AI Analysis:**
The 503 Service Unavailable error suggests the web server is temporarily unable to handle requests...

---
```

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | - | Your OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model to use for chat |
| `OPENAI_MAX_TOKENS` | `300` | Max response tokens |
| `OPENAI_RETRY_ATTEMPTS` | `3` | Retry attempts on rate limit |
| `OPENAI_RETRY_BASE_SECONDS` | `1` | Base backoff delay |
| `BOOMERR_AI_SYSTEM_PROMPT` | See above | System instruction for AI |
| `BOOMERR_AI_HEADER_FILTER` | `server,content-type,cf-ray,x-powered-by` | Comma-separated header names |

## Rate Limiting

The system includes automatic retry with exponential backoff:
- 3 attempts by default (configurable)
- Backoff: 1s, 2s, 4s (with jitter)
- User-friendly fallback: "AI is busy right now. Please try again in a few seconds."

## Frontend Integration

### Auto-Load Chat on Incident Page
```typescript
// Chat history loads automatically when incident page opens
const chatHistoryQuery = useIncidentAIChatHistory(incidentId);

// Frontend polls for new analysis after page load
useEffect(() => {
  if (!incident.ai_summary) {
    setTimeout(() => chatHistoryQuery.refetch(), 2000);
  }
}, [incident]);
```

### Continue Chat
```typescript
const handleSendChat = async (e: React.FormEvent) => {
  const res = await aiChatMutation.mutateAsync(chatInput);
  setChatHistory(h => [...h, { role: 'ai', message: res.reply }]);
};
```

## Access Control

Training endpoints require `can-manage-company` middleware:
- Only workspace admins can export training data
- Protects sensitive incident information
- Audit trail via Laravel logs

## Use Cases

1. **Fine-Tuning OpenAI Models**
   - Export JSON data
   - Convert to JSONL format
   - Upload to OpenAI fine-tuning API

2. **Prompt Engineering**
   - Export text prompt
   - Use as few-shot examples
   - Improve system prompt based on real data

3. **Quality Assurance**
   - Review AI responses for accuracy
   - Identify patterns in misdiagnoses
   - Refine header filter and prompts

4. **Documentation**
   - Generate incident playbooks
   - Train support teams
   - Build knowledge base

## Best Practices

1. **Header Selection**
   - Include only diagnostic headers
   - Remove privacy-sensitive headers (cookies, auth)
   - Keep list under 10 headers for cost efficiency

2. **Training Data Quality**
   - Export only resolved incidents
   - Review AI responses before fine-tuning
   - Remove PII from training data

3. **Token Management**
   - Set reasonable `OPENAI_MAX_TOKENS` (300-500)
   - Monitor API usage via OpenAI dashboard
   - Use exponential backoff for rate limits

4. **Chat Context**
   - Frontend maintains full conversation history
   - Backend stores all messages for training
   - Context window respects token limits
