import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as mqtt from 'mqtt';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: mqtt.MqttClient;
  private connected = false;

  onModuleInit() {
    const url = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
    this.client = mqtt.connect(url, {
      clientId: `anagu-api-${Date.now()}`,
      reconnectPeriod: 1000,
    });
    this.client.on('connect', () => {
      this.connected = true;
      console.log('MQTT connected to', url);
    });
    this.client.on('error', (err) => console.error('MQTT error:', err.message));
    this.client.on('close', () => { this.connected = false; });
  }

  onModuleDestroy() {
    this.client?.end();
  }

  async publish(topic: string, payload: object, qos: 0 | 1 | 2 = 1): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.publish(topic, JSON.stringify(payload), { qos }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  subscribe(topic: string, handler: (payload: any) => void): void {
    this.client.subscribe(topic, { qos: 1 });
    this.client.on('message', (t, msg) => {
      if (t === topic) {
        try { handler(JSON.parse(msg.toString())); } catch { handler(msg.toString()); }
      }
    });
  }

  isConnected(): boolean {
    return this.connected;
  }
}
