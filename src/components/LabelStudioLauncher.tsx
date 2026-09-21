import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveHandoff } from '../labels/handoff';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Items the module is showing. */
  items: unknown[];
  /** Items the person selected. When empty, the studio opens with the list and nothing selected. */
  initialSelectedIds?: Set<string>;
  user?: unknown;
}

/**
 * Sends the person to the Label Studio with their items filled in. Modules render this where they used to open the old
 * pop-up: when isOpen turns true it hands the items over, calls onClose, and goes to /labels.
 */
export default function LabelStudioLauncher({ isOpen, onClose, items, initialSelectedIds }: Props) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isOpen) return;
    saveHandoff(items as unknown[], initialSelectedIds ?? []);
    onClose();
    navigate('/labels');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  return null;
}
