// Centralized UI copy for the settings page (app/app/settings/page.tsx) and webhook settings (components/webhooks/webhook-settings.tsx).
// Extracted so this page's strings live in one place instead of scattered through JSX (issue #793).

export const settingsCopy = {
  metadata: {
    title: "Settings — FlowStar",
    description: "Configure webhooks and notification preferences.",
  },

  page: {
    title: "Settings",
    subtitle: "Configure webhooks and notification preferences for your streams.",
    sections: {
      display: {
        title: "Display",
      },
      notifications: {
        title: "Notifications",
        description:
          "Choose which in-app notification types you want to see. Disabled types are never recorded or shown, including as browser notifications.",
      },
      webhooks: {
        title: "Webhooks",
        description:
          "Register webhook URLs to receive HTTP POST notifications when stream events occur. Webhooks are stored per-wallet in your browser. Use the toggle to temporarily disable a webhook without deleting it.",
      },
      addressBook: {
        title: "Address Book",
        description:
          "Addresses you save while creating a stream. Rename or remove entries here.",
      },
      dangerZone: {
        title: "Danger zone",
      },
    },
  },

  webhooks: {
    eventLabels: {
      streamCreated: "Stream Created",
      withdrawal: "Withdrawal",
      cancelled: "Cancelled",
      completed: "Completed",
      toppedUp: "Topped Up",
      transferred: "Transferred",
    },
    register: {
      title: "Register a webhook",
      urlLabel: "Webhook URL",
      urlPlaceholder: "https://your-service.com/webhook",
      eventsLabel: "Event types",
      button: "Register webhook",
    },
    secret: {
      title: "Signing secret",
      description:
        "Use this to verify the X-FlowStar-Signature header on incoming deliveries (see docs/WEBHOOKS.md). It will not be shown again — copy it now.",
      copyButton: "Copy",
      dismissButton: "Dismiss",
      copiedToast: "Copied to clipboard",
    },
    registered: {
      title: "Registered webhooks",
      emptyTitle: "No webhooks registered yet",
      emptyDescription:
        "Register a webhook above to start receiving real-time event notifications for your streams.",
      emptyButton: "Register your first webhook",
      toggleDisableAria: "Disable",
      toggleEnableAria: "Enable",
      sendTestAria: "Send test",
      removeAria: "Remove",
    },
    history: {
      title: "Recent deliveries",
      exportCsv: "Export CSV",
      exportJson: "Export JSON",
      resendAria: "Resend delivery",
    },
    toasts: {
      storageWarningTitle: "Webhook settings aren't being saved",
      storageWarningDescription:
        "Storage is full or unavailable — your changes may not persist.",
      registeredTitle: "Webhook registered",
      registeredDescription:
        "Save the signing secret shown below — it will not be shown again.",
      testSuccess: "Test delivered successfully",
      testFailedTitle: "Test delivery failed",
      testFailedDescription: "Check the URL and try again.",
      resendSuccess: "Delivery resent successfully",
      resendFailedTitle: "Resend failed",
      resendFailedDescription: "Check the webhook URL and try again.",
    },
    validation: {
      urlRequired: "URL is required",
      urlInvalid: "Please enter a valid webhook URL",
      eventsRequired: "Select at least one event type",
    },
  },
};
