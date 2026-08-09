import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACTIVITY_TYPES } from '../constants/activityTypes.js';
import { sanitizeDocumentHtml } from '../services/documentWorkflow.service.js';

describe('Phase 8 document workflow foundation', () => {
  it('adds versioned document models through a production migration', () => {
    const migration = readFileSync('prisma/migrations/20260731100000_phase_8_document_workflow/migration.sql', 'utf8');

    expect(migration).toContain('CREATE TYPE "DocumentType"');
    expect(migration).toContain('CREATE TYPE "DocumentStatus"');
    expect(migration).toContain('CREATE TABLE "DocumentTemplate"');
    expect(migration).toContain('CREATE TABLE "Document"');
    expect(migration).toContain('CREATE TABLE "DocumentVersion"');
    expect(migration).toContain('CREATE TABLE "DocumentPublicToken"');
    expect(migration).toContain('CREATE TABLE "DocumentAcceptance"');
    expect(migration).toContain('CREATE UNIQUE INDEX "DocumentPublicToken_tokenHash_key"');
    expect(migration).toContain('CREATE UNIQUE INDEX "DocumentAcceptance_documentId_versionId_key"');
  });

  it('declares document activity events for timeline/audit logging', () => {
    expect(ACTIVITY_TYPES.DOCUMENT_CREATED).toBe('DOCUMENT_CREATED');
    expect(ACTIVITY_TYPES.DOCUMENT_MARKED_READY).toBe('DOCUMENT_MARKED_READY');
    expect(ACTIVITY_TYPES.DOCUMENT_SENT).toBe('DOCUMENT_SENT');
    expect(ACTIVITY_TYPES.DOCUMENT_VIEWED).toBe('DOCUMENT_VIEWED');
    expect(ACTIVITY_TYPES.DOCUMENT_ACCEPTED).toBe('DOCUMENT_ACCEPTED');
    expect(ACTIVITY_TYPES.DOCUMENT_REJECTED).toBe('DOCUMENT_REJECTED');
    expect(ACTIVITY_TYPES.DOCUMENT_REVISION_CREATED).toBe('DOCUMENT_REVISION_CREATED');
  });

  it('uses hashed public tokens and version-aware acceptance', () => {
    const service = readFileSync('src/services/documentWorkflow.service.ts', 'utf8');

    expect(service).toContain("crypto.randomBytes(32).toString('base64url')");
    expect(service).toContain("crypto.createHash('sha256')");
    expect(service).toContain('currentVersionId !== record.versionId');
    expect(service).toContain('documentId_versionId');
    expect(service).toContain('DOCUMENT_VERSION_IMMUTABLE');
  });

  it('exposes internal and public document routes', () => {
    const app = readFileSync('src/app.ts', 'utf8');
    const internalRoutes = readFileSync('src/routes/documents.routes.ts', 'utf8');
    const publicRoutes = readFileSync('src/routes/public-documents.routes.ts', 'utf8');

    expect(app).toContain("app.use('/api/documents', documentRoutes)");
    expect(app).toContain("app.use('/api/public/documents', publicDocumentRoutes)");
    expect(internalRoutes).toContain("router.post('/:id/ready'");
    expect(internalRoutes).toContain("router.post('/:id/revisions'");
    expect(publicRoutes).toContain("router.post('/:token/accept'");
    expect(publicRoutes).toContain("router.post('/:token/reject'");
  });

  it('sanitizes unsafe tenant-provided HTML before public rendering', () => {
    const html = sanitizeDocumentHtml('<h1>Hello</h1><script>alert(1)</script><p onclick="bad()">x</p><a href="javascript:bad()">bad</a>');

    expect(html).toContain('<h1>Hello</h1>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('javascript:');
  });
});
