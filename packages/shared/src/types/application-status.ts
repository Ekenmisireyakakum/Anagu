/**
 * All possible statuses an ANAGU land title application can have.
 * Statuses follow the application's journey through the registration workflow.
 */
export enum ApplicationStatus {
  /** Application submitted by citizen, awaiting initial review */
  SUBMITTED = 'SUBMITTED',
  /** Documents under review by registrar staff */
  UNDER_REVIEW = 'UNDER_REVIEW',
  /** Additional documents or information requested from applicant */
  PENDING_DOCUMENTS = 'PENDING_DOCUMENTS',
  /** Spatial/GIS verification in progress by surveyor */
  SPATIAL_VERIFICATION = 'SPATIAL_VERIFICATION',
  /** Ownership history check in progress */
  OWNERSHIP_VERIFICATION = 'OWNERSHIP_VERIFICATION',
  /** Application approved by registrar, awaiting governor sign-off */
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  /** Final approval granted — ready for blockchain minting */
  APPROVED = 'APPROVED',
  /** Land title NFT minted on Besu blockchain */
  TITLE_ISSUED = 'TITLE_ISSUED',
  /** Application rejected at any stage */
  REJECTED = 'REJECTED',
  /** Application withdrawn by applicant */
  WITHDRAWN = 'WITHDRAWN',
  /** Title has been revoked after issuance */
  REVOKED = 'REVOKED',
}
