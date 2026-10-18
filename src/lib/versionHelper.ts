import { Inspection, InspectionEnvironment } from '../types';

/**
 * Generates a normalized canonical fingerprint for the structure of environments and items.
 * Ignores execution data (photos, observations, status) and only evaluates:
 * - Environment names
 * - Item names and descriptions
 */
export function getStructureFingerprint(environments: InspectionEnvironment[]): string {
  if (!environments || environments.length === 0) return 'empty';

  const normalized = environments
    .map((env) => ({
      name: (env.name || '').trim().toLowerCase(),
      items: (env.items || [])
        .map((it) => ({
          name: (it.name || '').trim().toLowerCase(),
          description: (it.description || '').trim().toLowerCase(),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return JSON.stringify(normalized);
}

/**
 * Determines the structure version for an inspection.
 * - If identical to any previously registered version in the condominium: returns that version number.
 * - If different from all existing versions: increments and creates a new version number (e.g. Versão 2).
 */
export function determineStructureVersion(
  condominiumId: string,
  environments: InspectionEnvironment[],
  existingInspections: Inspection[],
  currentInspectionId?: string
): number {
  if (!environments || environments.length === 0) return 1;

  // Filter previous inspections for the same condominium
  const condoInspections = existingInspections
    .filter(
      (insp) =>
        (insp.condominiumId === condominiumId || !condominiumId) &&
        insp.id !== currentInspectionId
    )
    .sort((a, b) => (a.startedAt || a.date || '').localeCompare(b.startedAt || b.date || ''));

  const fingerprintToVersion = new Map<string, number>();
  let maxVersion = 0;

  for (const insp of condoInspections) {
    const fp = getStructureFingerprint(insp.environments || []);
    if (fp === 'empty') continue;

    if (!fingerprintToVersion.has(fp)) {
      const v = insp.structureVersion && insp.structureVersion > 0 ? insp.structureVersion : maxVersion + 1;
      fingerprintToVersion.set(fp, v);
      if (v > maxVersion) maxVersion = v;
    }
  }

  const currentFp = getStructureFingerprint(environments);
  if (fingerprintToVersion.has(currentFp)) {
    return fingerprintToVersion.get(currentFp)!;
  }

  return maxVersion + 1;
}
