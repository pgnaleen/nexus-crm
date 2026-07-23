import { promises as fs } from "fs";
import { join } from "path";
import { Logger } from "@nestjs/common";
import { EMPLOYEE_CV_SUBDIR, EMPLOYEE_PHOTO_SUBDIR, UPLOAD_DIR } from "./uploads.constants";

const logger = new Logger("UploadedFileUtil");

// Subdirs an update flow is allowed to clean up. Deliberately NOT every
// upload subdir -- only the two whose owning rows (employees.profile_photo_url
// / employees.s3_key) get replaced in place by Story 1.4's edit form.
const DELETABLE_SUBDIRS = [EMPLOYEE_PHOTO_SUBDIR, EMPLOYEE_CV_SUBDIR];

// Story 1.4 (Update Employee Record) -- when a profile photo or CV is
// replaced (or cleared), the old file must not be left orphaned on disk.
// Best-effort by design: a failed unlink logs and returns, it must NEVER
// fail the caller's real operation (same posture as audit-log writes).
//
// `url` is the stored value, e.g. "/uploads/employee-photos/<uuid>.png".
// Anything not matching one of the two allowed subdirs -- or whose filename
// contains a path separator or ".." -- is refused outright, so a corrupted
// or malicious stored value can never delete outside those directories.
export async function deleteUploadedEmployeeFile(url: string): Promise<void> {
  try {
    const match = /^\/uploads\/([^/]+)\/([^/]+)$/.exec(url);
    const subdir = match?.[1];
    const filename = match?.[2];
    if (!subdir || !filename) {
      logger.warn(`deleteUploadedEmployeeFile: refusing unrecognized url shape "${url}"`);
      return;
    }
    if (!DELETABLE_SUBDIRS.includes(subdir)) {
      logger.warn(`deleteUploadedEmployeeFile: refusing non-employee subdir "${subdir}"`);
      return;
    }
    if (filename.includes("..") || filename.includes("\\")) {
      logger.warn(`deleteUploadedEmployeeFile: refusing suspicious filename "${filename}"`);
      return;
    }
    const absolutePath = join(process.cwd(), UPLOAD_DIR, subdir, filename);
    await fs.unlink(absolutePath);
    logger.debug(`deleteUploadedEmployeeFile: removed ${subdir}/${filename}`);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      // Already gone -- nothing to clean up; not an error.
      logger.debug(`deleteUploadedEmployeeFile: ${url} already absent`);
      return;
    }
    logger.warn(`deleteUploadedEmployeeFile failed for ${url}: ${(err as Error).message}`);
  }
}
