import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity contract environment
const mockContractEnv = () => {
  const state = {
    admin: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    txSender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    blockHeight: 100,
    firmwareRegistry: new Map(),
    deviceFirmware: new Map()
  };
  
  return {
    state,
    // Mock contract functions
    registerFirmware: (deviceType, version, hash) => {
      if (state.txSender !== state.admin) {
        return { err: 403 };
      }
      
      const key = `${deviceType}-${version}`;
      state.firmwareRegistry.set(key, {
        hash,
        releaseDate: state.blockHeight,
        isCurrent: true
      });
      
      return { ok: true };
    },
    
    updateDeviceFirmware: (deviceId, deviceType, version, hash) => {
      const key = `${deviceType}-${version}`;
      if (!state.firmwareRegistry.has(key)) {
        return { err: 404 };
      }
      
      const registeredFirmware = state.firmwareRegistry.get(key);
      if (!registeredFirmware.hash.every((val, i) => val === hash[i])) {
        return { err: 400 };
      }
      
      state.deviceFirmware.set(deviceId, {
        currentVersion: version,
        currentHash: hash,
        lastUpdated: state.blockHeight
      });
      
      return { ok: true };
    },
    
    verifyFirmware: (deviceId, hash) => {
      if (!state.deviceFirmware.has(deviceId)) {
        return { err: 404 };
      }
      
      const firmware = state.deviceFirmware.get(deviceId);
      const isValid = firmware.currentHash.every((val, i) => val === hash[i]);
      
      return { ok: isValid };
    },
    
    isFirmwareCurrent: (deviceId, deviceType) => {
      if (!state.deviceFirmware.has(deviceId)) {
        return { err: 404 };
      }
      
      const firmware = state.deviceFirmware.get(deviceId);
      const key = `${deviceType}-${firmware.currentVersion}`;
      
      if (!state.firmwareRegistry.has(key)) {
        return { err: 404 };
      }
      
      return { ok: state.firmwareRegistry.get(key).isCurrent };
    },
    
    transferAdmin: (newAdmin) => {
      if (state.txSender !== state.admin) {
        return { err: 403 };
      }
      
      state.admin = newAdmin;
      return { ok: true };
    },
    
    // Helper to change the tx-sender for testing
    setTxSender: (sender) => {
      state.txSender = sender;
    }
  };
};

describe('Firmware Verification Contract', () => {
  let contract;
  
  beforeEach(() => {
    contract = mockContractEnv();
  });
  
  it('should register firmware successfully', () => {
    const hash = new Uint8Array(32).fill(1); // Mock hash
    const result = contract.registerFirmware('sensor-type-a', '1.0.0', hash);
    expect(result).toEqual({ ok: true });
  });
  
  it('should fail to register firmware if not admin', () => {
    contract.setTxSender('ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
    const hash = new Uint8Array(32).fill(1);
    const result = contract.registerFirmware('sensor-type-a', '1.0.0', hash);
    expect(result).toEqual({ err: 403 });
  });
  
  it('should update device firmware successfully', () => {
    // First register firmware
    const hash = new Uint8Array(32).fill(1);
    contract.registerFirmware('sensor-type-a', '1.0.0', hash);
    
    // Then update device firmware
    const result = contract.updateDeviceFirmware('device123', 'sensor-type-a', '1.0.0', hash);
    expect(result).toEqual({ ok: true });
  });
  
  it('should fail to update device firmware with unregistered version', () => {
    const hash = new Uint8Array(32).fill(1);
    const result = contract.updateDeviceFirmware('device123', 'sensor-type-a', '1.0.0', hash);
    expect(result).toEqual({ err: 404 });
  });
  
  it('should fail to update device firmware with incorrect hash', () => {
    // Register firmware with one hash
    const hash1 = new Uint8Array(32).fill(1);
    contract.registerFirmware('sensor-type-a', '1.0.0', hash1);
    
    // Try to update with different hash
    const hash2 = new Uint8Array(32).fill(2);
    const result = contract.updateDeviceFirmware('device123', 'sensor-type-a', '1.0.0', hash2);
    expect(result).toEqual({ err: 400 });
  });
  
  it('should verify firmware successfully', () => {
    // Register and update firmware
    const hash = new Uint8Array(32).fill(1);
    contract.registerFirmware('sensor-type-a', '1.0.0', hash);
    contract.updateDeviceFirmware('device123', 'sensor-type-a', '1.0.0', hash);
    
    // Verify firmware
    const result = contract.verifyFirmware('device123', hash);
    expect(result).toEqual({ ok: true });
  });
  
  it('should check if firmware is current', () => {
    // Register and update firmware
    const hash = new Uint8Array(32).fill(1);
    contract.registerFirmware('sensor-type-a', '1.0.0', hash);
    contract.updateDeviceFirmware('device123', 'sensor-type-a', '1.0.0', hash);
    
    // Check if current
    const result = contract.isFirmwareCurrent('device123', 'sensor-type-a');
    expect(result).toEqual({ ok: true });
  });
});
