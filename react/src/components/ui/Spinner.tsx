import { Loader2 } from "lucide-react";

export default function Spinner() {
  return (
    <div className="flex items-center justify-center">
      <Loader2 className="animate-spin h-6 w-6 text-gray-600" />
    </div>
  );
}
