// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - base-64 doesn't ship types in this project
import { decode as b64decode, encode as b64encode } from 'base-64';

export const FIRMWARE_SERVICE_UUID = '08f7e6d5-c4b3-a291-807f-6e5d4c3b2a7e';
export const CODE_CHAR_UUID = 'faebdccd-beaf-9081-7263-544536271809';
export const REQUEST_CHAR_UUID = '5b7c0d8e-9fa1-b2c3-d4e5-f60718293a4b';

export function normalizeMacUpperColon(input: string) {
  const s = input.trim().toUpperCase();
  const colon = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
  if (colon.test(s)) return s;
  const hex = s.replace(/[^0-9A-F]/g, '');
  if (hex.length !== 12) return s;
  return hex.match(/.{2}/g)!.join(':');
}

export type ConnectedBleDevice = {
  manager: any;
  device: any;
};

export async function scanAndConnectFirst({
  manager,
  timeoutMs = 15000,
}: {
  manager: any;
  timeoutMs?: number;
}): Promise<any> {
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      try {
        manager.stopDeviceScan();
      } catch {
        // ignore
      }
      reject(new Error('Timed out scanning for device.'));
    }, timeoutMs);

    manager.startDeviceScan([FIRMWARE_SERVICE_UUID], null, async (error: any, device: any) => {
      if (error) {
        clearTimeout(timeout);
        try {
          manager.stopDeviceScan();
        } catch {
          // ignore
        }
        reject(error);
        return;
      }
      if (!device) return;

      clearTimeout(timeout);
      try {
        manager.stopDeviceScan();
      } catch {
        // ignore
      }

      resolve(device);
    });
  });
}

export async function connectAndDiscover(manager: any, device: any): Promise<any> {
  const connected = await manager.connectToDevice(device.id, { timeout: 12000 });
  return await connected.discoverAllServicesAndCharacteristics();
}

export async function requestDeviceMac(manager: any, device: any): Promise<string> {
  const reqBytesB64 = b64encode('REQ');

  let sub: any | null = null;
  try {
    const valuePromise = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (sub) sub.remove();
        reject(new Error('Timed out waiting for MAC.'));
      }, 2500);

      sub = device.monitorCharacteristicForService(FIRMWARE_SERVICE_UUID, CODE_CHAR_UUID, (error: any, ch: any) => {
        if (error) {
          clearTimeout(timeout);
          if (sub) sub.remove();
          reject(error);
          return;
        }
        const v = ch?.value;
        if (!v) return;
        clearTimeout(timeout);
        if (sub) sub.remove();
        try {
          resolve(b64decode(v).trim());
        } catch (e: any) {
          reject(e);
        }
      });
    });

    await device.writeCharacteristicWithResponseForService(
      FIRMWARE_SERVICE_UUID,
      REQUEST_CHAR_UUID,
      reqBytesB64,
    );

    const mac = await valuePromise;
    return normalizeMacUpperColon(mac);
  } finally {
    try {
      if (sub) sub.remove();
    } catch {
      // ignore
    }
  }
}

