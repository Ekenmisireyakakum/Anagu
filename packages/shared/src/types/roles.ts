/**
 * User roles in the ANAGU land administration system.
 * Each role has specific permissions and workflow responsibilities.
 */
export enum UserRole {
  /** Ordinary citizen applying for land titles */
  CITIZEN = 'CITIZEN',
  /** Licensed land surveyor performing spatial verification */
  SURVEYOR = 'SURVEYOR',
  /** Lands registry official processing applications */
  REGISTRAR = 'REGISTRAR',
  /** Senior official with administrative override capabilities */
  LAND_ADMINISTRATOR = 'LAND_ADMINISTRATOR',
  /** Highest authority — can approve final issuance and revocations */
  GOVERNOR = 'GOVERNOR',
}
