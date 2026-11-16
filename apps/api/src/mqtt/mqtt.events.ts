import { MQTT_TOPICS } from '@anagu/shared';

export const MQTT_EVENTS = {
  APPLICATION_SUBMITTED: MQTT_TOPICS.APPLICATION_SUBMITTED,
  APPLICATION_STATUS_CHANGED: MQTT_TOPICS.APPLICATION_STATUS_CHANGED,
  OWNERSHIP_VERIFIED: MQTT_TOPICS.OWNERSHIP_VERIFIED,
} as const;

export interface MqttPublishPayload {
  topic: string;
  payload: Record<string, unknown>;
  timestamp: string;
}
