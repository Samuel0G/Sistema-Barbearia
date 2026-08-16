import { neon } from '@neondatabase/serverless';

let sqlClient;

// Reaproveita a conexao entre chamadas dentro da mesma funcao serverless "quente".
export function getSql() {
  if (!sqlClient) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('Variavel de ambiente DATABASE_URL nao configurada.');
    }
    sqlClient = neon(connectionString);
  }
  return sqlClient;
}
