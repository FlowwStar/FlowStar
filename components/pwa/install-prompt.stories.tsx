import type { Meta, StoryObj } from '@storybook/react';
import { InstallPrompt } from './install-prompt';

const DISMISSED_KEY = 'flowstar:install-prompt-dismissed';

type MockBeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function createBeforeInstallPromptEvent(): MockBeforeInstallPromptEvent {
  const event = new Event('beforeinstallprompt', {
    bubbles: true,
    cancelable: true,
  }) as MockBeforeInstallPromptEvent;

  event.prompt = () => Promise.resolve();
  event.userChoice = Promise.resolve({ outcome: 'accepted' });

  return event;
}

function dispatchBeforeInstallPrompt(): void {
  window.dispatchEvent(createBeforeInstallPromptEvent());
}

const meta: Meta<typeof InstallPrompt> = {
  title: 'PWA/InstallPrompt',
  component: InstallPrompt,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof InstallPrompt>;

export const Visible: Story = {
  beforeEach: () => {
    window.localStorage.removeItem(DISMISSED_KEY);
    dispatchBeforeInstallPrompt();
  },
  play: async () => {
    dispatchBeforeInstallPrompt();
  },
  afterEach: () => {
    window.localStorage.removeItem(DISMISSED_KEY);
  },
};

export const Dismissed: Story = {
  beforeEach: () => {
    window.localStorage.setItem(DISMISSED_KEY, '1');
    dispatchBeforeInstallPrompt();
  },
  play: async () => {
    dispatchBeforeInstallPrompt();
  },
  afterEach: () => {
    window.localStorage.removeItem(DISMISSED_KEY);
  },
};