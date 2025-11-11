import { S3Client, ListObjectsV2Command, DeleteObjectsCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

async function cleanupAllB2Files() {
  console.log("🔴 INICIANDO LIMPIEZA COMPLETA DE BACKBLAZE B2...\n");
  
  const endpoint = process.env.B2_ENDPOINT;
  const keyId = process.env.B2_APPLICATION_KEY_ID;
  const appKey = process.env.B2_APPLICATION_KEY;
  const bucketName = process.env.B2_BUCKET_NAME;

  if (!endpoint || !keyId || !appKey || !bucketName) {
    console.error("❌ Error: Backblaze B2 no está configurado correctamente");
    console.error("   Verifica que las variables de entorno estén configuradas:");
    console.error("   - B2_ENDPOINT");
    console.error("   - B2_APPLICATION_KEY_ID");
    console.error("   - B2_APPLICATION_KEY");
    console.error("   - B2_BUCKET_NAME");
    process.exit(1);
  }

  // Asegurarse de que el endpoint tenga el protocolo https://
  let correctedEndpoint = endpoint;
  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    correctedEndpoint = `https://${endpoint}`;
  }

  const region = extractRegionFromEndpoint(correctedEndpoint);

  const client = new S3Client({
    endpoint: correctedEndpoint,
    region: region,
    credentials: {
      accessKeyId: keyId,
      secretAccessKey: appKey,
    },
    forcePathStyle: true,
  });

  console.log(`📦 Bucket: ${bucketName}`);
  console.log(`🌍 Region: ${region}`);
  console.log(`🔗 Endpoint: ${correctedEndpoint}\n`);

  try {
    let totalDeleted = 0;
    let continuationToken: string | undefined = undefined;
    let pageCount = 0;

    do {
      pageCount++;
      console.log(`📄 Listando objetos (página ${pageCount})...`);

      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
        MaxKeys: 1000, // Máximo de objetos por página
      });

      const listResponse = await client.send(listCommand);
      const objects = listResponse.Contents || [];

      if (objects.length === 0) {
        console.log("   ℹ️  No se encontraron más objetos");
        break;
      }

      console.log(`   ✓ Encontrados ${objects.length} objetos en esta página`);

      // Eliminar objetos en lotes de 1000 (límite de DeleteObjects)
      if (objects.length > 0) {
        // Opción 1: Usar DeleteObjects para eliminar múltiples archivos a la vez
        const objectsToDelete = objects.map(obj => ({ Key: obj.Key! }));
        
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: {
            Objects: objectsToDelete,
            Quiet: true, // No devolver lista de archivos eliminados (más rápido)
          },
        });

        console.log(`   🗑️  Eliminando ${objects.length} objetos...`);
        await client.send(deleteCommand);
        totalDeleted += objects.length;
        console.log(`   ✓ Eliminados ${objects.length} objetos (Total: ${totalDeleted})`);
      }

      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

    console.log(`\n✅ LIMPIEZA COMPLETA EXITOSA`);
    console.log(`   Total de archivos eliminados: ${totalDeleted}`);
    console.log(`   El bucket ${bucketName} está ahora completamente vacío\n`);

  } catch (error) {
    console.error("\n❌ Error durante la limpieza:", error);
    if (error instanceof Error) {
      console.error(`   Mensaje: ${error.message}`);
    }
    throw error;
  }
}

function extractRegionFromEndpoint(endpoint: string): string {
  const match = endpoint.match(/s3\.([^.]+)\./);
  return match ? match[1] : 'us-west-004';
}

// Ejecutar el script
cleanupAllB2Files()
  .then(() => {
    console.log("✅ Script completado exitosamente");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error fatal:", error);
    process.exit(1);
  });
