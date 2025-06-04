import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Spinner from '@/components/ui/Spinner';
import { toast } from "sonner";
import { useState } from 'react';

interface InstallComfyUIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstallSuccess?: () => void;
}

const InstallComfyUIDialog = ({ open, onOpenChange, onInstallSuccess }: InstallComfyUIDialogProps) => {
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstallComfyUI = async () => {
    setIsInstalling(true);
    try {
      const result = await window.electronAPI.installComfyUI();
      if (result.success) {
        toast.success("ComfyUI installation successful!");
        onOpenChange(false);
        onInstallSuccess?.();
      } else {
        toast.error(`Installation failed: ${result.error}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Installation failed: ${errorMessage}`);
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>🎨 Install Flux Image Generation Model</DialogTitle>
          <DialogDescription>
            No image generation models detected.
            <br />
            To use AI image generation features, you can install ComfyUI and Flux models.
            <br />
            This will:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Download and install ComfyUI (~2000MB)</li>
              <li>Configure Flux image generation models</li>
              <li>Start local image generation service</li>
            </ul>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isInstalling}
          >
            Cancel
          </Button>
          <Button
            onClick={handleInstallComfyUI}
            disabled={isInstalling}
          >
            {isInstalling ? (
              <>
                <Spinner />
                Installing...
              </>
            ) : (
              "Install Flux Image Model"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InstallComfyUIDialog;
