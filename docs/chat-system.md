# Arch Studios Chat System Implementation Guide

## Overview

This document describes the implementation of a database-backed chat system for Arch Studios using Supabase's Realtime functionality. The system supports:

1. Project-specific channels for team communication
2. Private and public channels
3. Real-time message delivery
4. File attachments
5. Read/unread tracking
6. Security through row-level policies that isolate organizations' data

## Database Schema

The chat system is built on the following tables:

1. **channels**: Stores chat channels associated with projects
2. **messages**: Stores individual messages sent in channels
3. **channel_members**: Tracks membership for private channels
4. **user_channel_states**: Tracks which messages users have read
5. **message_attachments**: Stores file attachments for messages

These tables are created and configured in the migration file at `/src/supabase/migrations/20250520000000_chat_system.sql`.

### Security Model

The database implements row-level security (RLS) policies that ensure:

- Users can only see channels for projects they are members of
- Users can only see messages in channels they have access to
- Private channels require explicit membership
- Project admins have full access to all project channels

## Implementation Components

### 1. Chat Service (chat-service.ts)

The chat service in `/src/lib/chat-service.ts` provides methods for:

- Creating, reading, updating, and deleting channels
- Sending and receiving messages
- Adding and removing channel members
- Managing file attachments
- Tracking read/unread status
- Subscribing to real-time updates

### 2. WorkspaceContext Integration

The WorkspaceContext has been updated to integrate with the chat service:

- Channel and message state management
- Real-time subscriptions for live updates
- Utilities for loading channels and messages
- User-friendly interface for other components

### 3. CommunicationPanelIntegration Component

This component connects the UI with the WorkspaceContext and handles:

- Loading channels and messages
- Setting active channel
- Managing UI state for modals
- Tracking read/unread status

## Usage Guide

### Initialize a New Project

When a new project is created, call the `initializeProject` method:

```tsx
const { initializeProject } = useWorkspace();
await initializeProject(projectId, organizationId);
```

This creates default "general" and "announcements" channels.

### Load Channels and Messages

Use the utility methods to load channels and messages:

```tsx
const { loadChannelsForProject, loadMessagesForChannel } = useWorkspace();

// Load all channels for a project
await loadChannelsForProject(projectId);

// Load messages for a specific channel
await loadMessagesForChannel(channelId);
```

### Creating a Channel

```tsx
const { createChannel } = useWorkspace();

await createChannel(
  projectId, 
  channelName,
  isPrivate,  
  description // optional
);
```

### Sending Messages

```tsx
const { sendMessage } = useWorkspace();

await sendMessage(
  content,
  channelId,
  attachments // optional array of File objects
);
```

### Mark Channel as Read

```tsx
const { markChannelRead } = useWorkspace();

await markChannelRead(channelId);
```

## Real-time Updates

The system uses Supabase's Realtime functionality to deliver updates instantly:

1. **Channel Updates**: When channels are created, updated, or deleted
2. **Message Updates**: When new messages are sent
3. **Read Status Updates**: When users mark channels as read

The WorkspaceContext manages subscriptions and automatically updates the UI when changes occur.

## Testing

The chat system includes unit tests in `src/__tests__/chat-service.test.ts` that verify:

- Channel creation
- Message sending
- Channel and message retrieval
- Default channel initialization

## Future Improvements

1. **Message Editing and Deletion**: Allow users to edit and delete messages
2. **Rich Text Support**: Add support for formatting, code blocks, etc.
3. **Reactions**: Allow users to react to messages with emojis
4. **Threading**: Add support for message threads
5. **Read Receipts**: Show which users have read each message
