export interface VideoJobQueue {
  enqueue(mediaId: string): Promise<void>;
}
