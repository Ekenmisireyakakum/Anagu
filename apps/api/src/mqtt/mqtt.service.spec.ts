import { MqttService } from './mqtt.service';

describe('MqttService', () => {
  let service: MqttService;

  beforeAll(async () => {
    service = new MqttService();
    service.onModuleInit();
    await new Promise<void>((r) => setTimeout(r, 1500));
  }, 10000);

  afterAll(async () => {
    service.onModuleDestroy();
    await new Promise<void>((r) => setTimeout(r, 500));
  });

  it('connects to Mosquitto on localhost:1883', () => {
    expect(service.isConnected()).toBe(true);
  });

  it('publishes a message without error', async () => {
    await expect(
      service.publish('anagu/test/phase3', { test: true, ts: Date.now() })
    ).resolves.toBeUndefined();
  });

  it('round-trips a message (subscribe then publish)', async () => {
    const topic = 'anagu/test/roundtrip';
    const sent = { value: 42, id: `rt-${Date.now()}` };
    const received = await new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for MQTT message')), 5000);
      service.subscribe(topic, (payload) => {
        if (payload.id === sent.id) {
          clearTimeout(timer);
          resolve(payload);
        }
      });
      service.publish(topic, sent).catch(reject);
    });
    expect(received.value).toBe(42);
    expect(received.id).toBe(sent.id);
  });
});
