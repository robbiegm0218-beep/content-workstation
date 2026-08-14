"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { LandscapeVideo } from "../../video-renderer/src/compositions/LandscapeVideo";
import { PortraitVideo } from "../../video-renderer/src/compositions/PortraitVideo";
import type { CaptionCue, VideoRenderProps } from "../../video-renderer/src/types";
import type { LocalAsset, VideoScenePlan } from "../lib/local-bridge";
import { getLocalAssetBlob } from "../lib/local-bridge";

function parseTime(value: string) {
  const parts = value.replace(",", ".").split(":").map(Number);
  return parts.length === 3 ? (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000 : (parts[0] * 60 + parts[1]) * 1000;
}

function parseCaptions(text: string): CaptionCue[] {
  return text.replace(/^WEBVTT[^\n]*\n+/i, "").split(/\n\s*\n/).flatMap((block) => {
    const lines = block.trim().split(/\r?\n/).filter(Boolean);
    const index = lines.findIndex((line) => line.includes("-->"));
    if (index < 0) return [];
    const [start, end] = lines[index].split("-->").map((item) => item.trim().split(/\s+/)[0]);
    const startMs = parseTime(start); const endMs = parseTime(end); const cue = lines.slice(index + 1).join(" ").replace(/<[^>]+>/g, "").trim();
    return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs && cue ? [{ startMs, endMs, text: cue }] : [];
  }).slice(0, 500);
}

export function VideoPreview({ contentId, plan, assets, audioAssetId, captionsAssetId, activeSceneId = "", onActiveScene }: { contentId: string; plan: VideoScenePlan; assets: LocalAsset[]; audioAssetId: string; captionsAssetId: string; activeSceneId?: string; onActiveScene?: (sceneId: string) => void }) {
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [captions, setCaptions] = useState<CaptionCue[]>([]);
  const [loadError, setLoadError] = useState("");
  const playerRef = useRef<PlayerRef>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const requiredAssetInput = useMemo(() => JSON.stringify(assets.filter((asset) => plan.materials.includes(asset.relativePath) || asset.assetId === audioAssetId || asset.assetId === captionsAssetId)), [assets, audioAssetId, captionsAssetId, plan.materials]);

  useEffect(() => {
    let disposed = false;
    const urls: string[] = [];
    const requiredAssets = JSON.parse(requiredAssetInput) as LocalAsset[];
    void Promise.all(requiredAssets.map(async (asset) => {
      const blob = await getLocalAssetBlob(contentId, asset.assetId);
      if (asset.assetId === captionsAssetId) return { asset, text: await blob.text(), url: "" };
      const url = URL.createObjectURL(blob); urls.push(url); return { asset, text: "", url };
    })).then((loaded) => {
      if (disposed) { urls.forEach(URL.revokeObjectURL); return; }
      const previousUrls = objectUrlsRef.current;
      objectUrlsRef.current = urls;
      setLoadError("");
      setAssetUrls(Object.fromEntries(loaded.filter((item) => item.url).map((item) => [item.asset.relativePath, item.url])));
      const subtitle = loaded.find((item) => item.asset.assetId === captionsAssetId);
      setCaptions(subtitle?.text ? parseCaptions(subtitle.text) : []);
      window.setTimeout(() => previousUrls.forEach(URL.revokeObjectURL), 500);
    }).catch((error) => { if (!disposed) setLoadError(error instanceof Error ? error.message : "素材加载失败"); });
    return () => { disposed = true; };
  }, [captionsAssetId, contentId, requiredAssetInput]);

  useEffect(() => () => { objectUrlsRef.current.forEach(URL.revokeObjectURL); }, []);

  useEffect(() => {
    const scene = plan.scenes.find((entry) => entry.id === activeSceneId);
    if (scene) playerRef.current?.seekTo(scene.startFrame);
  }, [activeSceneId, plan.scenes]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !onActiveScene) return;
    const updateActiveScene = ({ detail }: { detail: { frame: number } }) => {
      const scene = plan.scenes.find((entry) => detail.frame >= entry.startFrame && detail.frame < entry.startFrame + entry.durationInFrames);
      if (scene && scene.id !== activeSceneId) onActiveScene(scene.id);
    };
    player.addEventListener("timeupdate", updateActiveScene);
    return () => player.removeEventListener("timeupdate", updateActiveScene);
  }, [activeSceneId, onActiveScene, plan.scenes]);

  const props = useMemo<VideoRenderProps>(() => ({ ...plan, assetUrlMap: assetUrls, assetKindMap: Object.fromEntries(assets.filter((asset): asset is LocalAsset & { kind: "image" | "video" } => asset.kind === "image" || asset.kind === "video").map((asset) => [asset.relativePath, asset.kind])), audioSrc: assets.find((asset) => asset.assetId === audioAssetId) ? assetUrls[assets.find((asset) => asset.assetId === audioAssetId)!.relativePath] : undefined, captions }), [assetUrls, assets, audioAssetId, captions, plan]);
  const previewDuration = Math.max(1, plan.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0));
  const VideoComponent = plan.aspectRatio === "9:16" ? PortraitVideo : LandscapeVideo;
  return <div className={`remotion-player-wrap ${plan.aspectRatio === "9:16" ? "portrait" : "landscape"}`}>{loadError && <div className="video-preview-error" role="alert">{loadError}</div>}<Player ref={playerRef} component={VideoComponent} inputProps={props} durationInFrames={previewDuration} compositionWidth={plan.width} compositionHeight={plan.height} fps={plan.fps} controls acknowledgeRemotionLicense renderLoading={() => <div className="player-loading">正在准备预览…</div>} /></div>;
}
