import "tldraw/tldraw.css";
import { useEffect, useRef, useState } from "react";
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { DataURL, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { nanoid } from "nanoid";
import {
  ExcalidrawImageElement,
  FileId,
} from "@excalidraw/excalidraw/element/types";

export default function CanvasExcali() {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const lastImagePosition = useRef<{ x: number; y: number }>({
    x: 100,
    y: 100,
  });

  useEffect(() => {
    const imgUrl =
      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Aspect-ratio-16x9.svg/1024px-Aspect-ratio-16x9.svg.png";

    const addImageToExcalidraw = async (imageData: {
      url: string;
      mime_type: string;
      width: number;
      height: number;
    }) => {
      if (!excalidrawAPI) return;

      const imageDataUrl = imageData.url;

      if (!excalidrawAPI) return;

      // Convert base64 data URL to File
      const fileid = nanoid() as FileId;

      // Add file to Excalidraw
      excalidrawAPI.addFiles([
        {
          mimeType: imageData.mime_type,
          id: fileid,
          dataURL: imageDataUrl as DataURL,
          created: Date.now(),
        },
      ]);

      // Position image next to the previous one
      const { x, y } = lastImagePosition.current;
      const newX = x + 200; // adjust spacing as needed
      const newY = y;

      const imageElement: ExcalidrawImageElement = {
        type: "image",
        id: fileid,
        x: newX,
        y: newY,
        width: imageData.width,
        height: imageData.height,
        angle: 0,
        fileId: fileid,
        strokeColor: "#000000",
        backgroundColor: "transparent",
        strokeWidth: 1,
        roughness: 0,
        opacity: 100,
        groupIds: [],
        seed: Math.floor(Math.random() * 100000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 100000),
        isDeleted: false,
      };

      excalidrawAPI.updateScene({
        elements: [imageElement],
      });

      // Update position for the next image
      lastImagePosition.current = { x: newX, y: newY };
    };

    const handleImageGenerated = (e: Event) => {
      const event = e as CustomEvent;
      console.log("👇image_generated", event.detail);
      addImageToExcalidraw(event.detail.image_data);
    };

    window.addEventListener("image_generated", handleImageGenerated);
    return () =>
      window.removeEventListener("image_generated", handleImageGenerated);
  }, [excalidrawAPI]);

  return (
    <Excalidraw
      excalidrawAPI={(api) => setExcalidrawAPI(api)}
      onChange={(e) => console.log(e)}
    />
  );
}
