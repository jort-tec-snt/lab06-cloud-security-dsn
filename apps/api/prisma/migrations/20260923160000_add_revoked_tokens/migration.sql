CREATE TABLE "tokens_revocados" (
    "jti" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_revocados_pkey" PRIMARY KEY ("jti")
);

CREATE INDEX "tokens_revocados_usuario_id_idx" ON "tokens_revocados"("usuario_id");
CREATE INDEX "tokens_revocados_expires_at_idx" ON "tokens_revocados"("expires_at");

ALTER TABLE "tokens_revocados" ADD CONSTRAINT "tokens_revocados_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
