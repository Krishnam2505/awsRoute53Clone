'use client';

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import Modal from '@cloudscape-design/components/modal';

const SHORTCUTS: [string, string][] = [
  ['/', 'Focus the table search box'],
  ['c', 'Create (hosted zone or record, depending on the page)'],
  ['r', 'Refresh the current table'],
  ['Esc', 'Close the open dialog'],
  ['Alt+S', 'Focus the console search'],
  ['?', 'Show this list'],
];

export function ShortcutsModal({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header="Keyboard shortcuts"
      footer={
        <Box float="right">
          <Button variant="primary" onClick={onDismiss}>
            Close
          </Button>
        </Box>
      }
    >
      <KeyValuePairs
        columns={1}
        items={SHORTCUTS.map(([key, action]) => ({
          label: <kbd className="kbd">{key}</kbd>,
          value: action,
        }))}
      />
    </Modal>
  );
}
