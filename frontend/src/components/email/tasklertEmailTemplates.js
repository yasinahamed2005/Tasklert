/**
 * Tasklert Mail Professional Email Templates (Phase 4)
 */

export const TASKLERT_EMAIL_TEMPLATES = [
  {
    id: "action_required",
    name: "Action Required",
    icon: "⚡",
    priority: "action_required",
    subject: "Action Required: Final Project Review",
    body: `Hello,\n\nPlease review the attached document and share your feedback by today.\n\nThank you,\n{sender_name}`,
  },
  {
    id: "project_update",
    name: "Project Update",
    icon: "📊",
    priority: "normal",
    subject: "Project Update: Milestone Progress Report",
    body: `Hi Team,\n\nHere is a quick summary of our recent progress:\n- Milestone 1 completed on schedule\n- Current focus is on testing and QA\n- Next deliverable is slated for next week\n\nPlease let me know if you have any questions.\n\nBest regards,\n{sender_name}`,
  },
  {
    id: "meeting_request",
    name: "Meeting Request",
    icon: "📅",
    priority: "normal",
    subject: "Meeting Request: Discussion & Strategy Alignment",
    body: `Hi,\n\nI would like to schedule a brief 20-minute meeting to discuss our upcoming deliverables and align on key priorities.\n\nPlease let me know if you have availability tomorrow morning or afternoon.\n\nLooking forward to speaking with you.\n\nWarm regards,\n{sender_name}`,
  },
  {
    id: "task_assignment",
    name: "Task Assignment",
    icon: "📋",
    priority: "important",
    subject: "Task Assignment: Details and Next Steps",
    body: `Hi,\n\nYou have been assigned to lead the task outlined below:\n- Deliverable: Finalized specs and timeline\n- Priority: High\n- Next checkpoint: End of week\n\nFeel free to reach out if you need additional context or resources.\n\nThanks,\n{sender_name}`,
  },
  {
    id: "document_sharing",
    name: "Document Sharing",
    icon: "📎",
    priority: "normal",
    subject: "Document Sharing: Requested Files Attached",
    body: `Hello,\n\nPlease find the requested files attached to this email. Let me know if you need any additional formats or information.\n\nBest regards,\n{sender_name}`,
  },
  {
    id: "intro",
    name: "Professional Introduction",
    icon: "🤝",
    priority: "normal",
    subject: "Introduction: Connecting via Tasklert",
    body: `Dear Partner,\n\nI hope this email finds you well. I am reaching out to introduce myself and explore potential collaboration opportunities between our teams.\n\nI would be delighted to connect at your convenience.\n\nSincerely,\n{sender_name}`,
  },
  {
    id: "followup",
    name: "Follow-up Email",
    icon: "🔄",
    priority: "normal",
    subject: "Follow-up: Checking in on our previous conversation",
    body: `Hi,\n\nI wanted to follow up on our earlier discussion and see if you had any updates regarding the next steps.\n\nWhenever you have a moment, please let me know how you would like to proceed.\n\nBest regards,\n{sender_name}`,
  },
  {
    id: "thank_you",
    name: "Thank You",
    icon: "🙏",
    priority: "normal",
    subject: "Thank You for your time and collaboration",
    body: `Hi,\n\nThank you so much for taking the time to connect today. I truly appreciate your insights and look forward to working together.\n\nWarm regards,\n{sender_name}`,
  },
  {
    id: "custom",
    name: "Custom Template",
    icon: "✍️",
    priority: "normal",
    subject: "",
    body: "",
  },
];
