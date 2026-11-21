import Button from './ui/Button';
import { Play } from 'lucide-react';

export default function DryRunButton({ onClick, loading, disabled }) {
  return (
    <div className="w-full flex justify-end">
      <Button
        type="button"
        variant="primary"
        onClick={onClick}
        loading={loading}
        disabled={disabled}
        icon={Play}
      >
        Generate Preview (Dry Run)
      </Button>
    </div>
  );
}
