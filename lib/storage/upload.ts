import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export async function uploadImageFromUri({
  uri,
  path,
  contentType = 'image/jpeg',
}: {
  uri: string;
  path: string;
  contentType?: string;
}): Promise<string> {
  const r = await fetch(uri);
  const blob = await r.blob();
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType });
  return await getDownloadURL(storageRef);
}

