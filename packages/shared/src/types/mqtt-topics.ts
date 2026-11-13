/**
 * MQTT topic constants for ANAGU real-time event messaging.
 * Topics follow the pattern: anagu/<entity>/<event>
 */
export const MQTT_TOPICS = {
  /** Published when a new application is submitted */
  APPLICATION_SUBMITTED: 'anagu/application/submitted',
  /** Published when application status changes */
  APPLICATION_STATUS_CHANGED: 'anagu/application/status-changed',
  /** Published when documents are uploaded to an application */
  DOCUMENT_UPLOADED: 'anagu/document/uploaded',
  /** Published when spatial verification completes */
  SPATIAL_VERIFIED: 'anagu/verification/spatial-complete',
  /** Published when ownership verification completes */
  OWNERSHIP_VERIFIED: 'anagu/verification/ownership-complete',
  /** Published when a land title NFT is minted */
  TITLE_MINTED: 'anagu/title/minted',
  /** Published when a land title is revoked */
  TITLE_REVOKED: 'anagu/title/revoked',
  /** Published for user-facing notification events */
  NOTIFICATION: 'anagu/notification',
} as const;

export type MqttTopic = typeof MQTT_TOPICS[keyof typeof MQTT_TOPICS];
