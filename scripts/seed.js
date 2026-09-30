import { db, closeDatabase } from '../backend/database/client.js';
import { DEMO_PASSWORD_HASH } from '../backend/config/demo-credentials.js';

if (!db.enabled) {
  console.error('DATABASE_URL não configurada. Configure .env antes de executar o seed.');
  process.exitCode = 1;
} else {
  await db.transaction(async (client) => {
    const org = (await client.query(`INSERT INTO organizations (name) VALUES ('AXIS Demo Industries') ON CONFLICT DO NOTHING RETURNING id`)).rows[0] || (await client.query(`SELECT id FROM organizations WHERE name = 'AXIS Demo Industries' LIMIT 1`)).rows[0];
    const user = (await client.query(`INSERT INTO users (name,email,role,password_hash) VALUES ('Ana Gonçalves','admin@axis.energy','ADMIN',$1) ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, role=EXCLUDED.role, password_hash=EXCLUDED.password_hash, updated_at=NOW() RETURNING id`, [DEMO_PASSWORD_HASH])).rows[0];
    await client.query(`INSERT INTO user_organizations (user_id, organization_id, role) VALUES ($1,$2,'ADMIN') ON CONFLICT DO NOTHING`, [user.id, org.id]);
    const machines = [['Máquina A1','PRODUÇÃO','ON',85],['Máquina A2','PRODUÇÃO','ON',72],['Máquina A3','PRODUÇÃO','OFF',68],['Compressor B1','COMPRESSORES','ON',45],['Compressor B2','COMPRESSORES','ON',38]];
    for (const [name, sector, status, power] of machines) await client.query(`INSERT INTO machines (organization_id,name,sector,status,base_power_kw,current_power_kw) SELECT $1,$2,$3,$4,$5,CASE WHEN $4='ON' THEN $5 ELSE 0 END WHERE NOT EXISTS (SELECT 1 FROM machines WHERE organization_id=$1 AND name=$2)`, [org.id,name,sector,status,power]);
    const sensors = [['SENSOR-001','POWER_METER','Production Line 1','ONLINE'],['SENSOR-002','HVAC','HVAC','ONLINE'],['SENSOR-003','POWER_METER','Warehouse','DEGRADED']];
    for (const [name,type,location,status] of sensors) await client.query(`INSERT INTO sensors (organization_id,name,type,location,status,last_reading) SELECT $1,$2,$3,$4,$5,NOW() WHERE NOT EXISTS (SELECT 1 FROM sensors WHERE organization_id=$1 AND name=$2)`, [org.id,name,type,location,status]);
  });
  console.log('Seed demo aplicado. A conta demo foi criada exclusivamente no backend.');
}
await closeDatabase();
