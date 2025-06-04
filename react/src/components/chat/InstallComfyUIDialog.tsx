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
import InstallProgressDialog from './InstallProgressDialog';

interface InstallComfyUIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstallSuccess?: () => void;
}

const InstallComfyUIDialog = ({ open, onOpenChange, onInstallSuccess }: InstallComfyUIDialogProps) => {
  const [isInstalling, setIsInstalling] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);

  const handleInstallComfyUI = async () => {
    setIsInstalling(true);
    setShowProgressDialog(true);
    onOpenChange(false); // Close the initial dialog

    try {
      const result = await window.electronAPI.installComfyUI();
      if (result.success) {
        toast.success("ComfyUI installation successful!");
      } else {
        toast.error(`Installation failed: ${result.error}`);
        setShowProgressDialog(false);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Installation failed: ${errorMessage}`);
      setShowProgressDialog(false);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleInstallComplete = () => {
    setShowProgressDialog(false);
    setIsInstalling(false);
    onInstallSuccess?.();
  };

  return (
    <>
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

      <InstallProgressDialog
        open={showProgressDialog}
        onOpenChange={setShowProgressDialog}
        onInstallComplete={handleInstallComplete}
      />
    </>
  );
};

export default InstallComfyUIDialog;
