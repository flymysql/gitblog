#!/usr/bin/env node
/**
 * CRX3 校验（发布前门禁）
 *
 * 用法:
 *   node verify-crx.mjs path/to/a.crx [more.crx ...]      # CLI，失败退出码 1
 *
 * 也可以 import { verifyCrx } from './verify-crx.mjs' 拿到结构化结果。
 *
 * 规则来自 Chromium: components/crx_file/crx_verifier.cc → VerifyCrx3()
 *   - version != 3                          → ERROR_HEADER_INVALID（装不上）
 *   - 签名载荷 = "CRX3 SignedData\0"
 *             + LE32(len(signed_header_data))
 *             + signed_header_data
 *             + archive(zip)
 *   注意长度是 **signed_header_data 的字节数**（这里 18），
 *   不是整个 CrxFileHeader 的长度 —— 取错就会「以为签名好了，其实装不上」。
 *
 * 说明：插件项目里的 tools/verify-crx.mjs 是同一套规则的副本（打包时用），
 * 这里再放一份是为了让发布链路离线自检、不依赖插件仓库里的文件。
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const SIGNATURE_CONTEXT = Buffer.from('CRX3 SignedData\x00', 'latin1');

function readVarint(buf, pos) {
  let result = 0;
  let shift = 0;
  for (;;) {
    const byte = buf[pos++];
    result += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return [result, pos];
}

function parseFields(buf) {
  const out = [];
  let pos = 0;
  while (pos < buf.length) {
    let tag;
    [tag, pos] = readVarint(buf, pos);
    const field = tag >>> 3;
    const wire = tag & 7;
    if (wire === 2) {
      let len;
      [len, pos] = readVarint(buf, pos);
      out.push({ field, value: buf.subarray(pos, pos + len) });
      pos += len;
    } else if (wire === 0) {
      let v;
      [v, pos] = readVarint(buf, pos);
      out.push({ field, value: v });
    } else {
      throw new Error(`不支持的 protobuf wire type: ${wire}`);
    }
  }
  return out;
}

const le32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};

export function extensionIdFromPublicKey(publicKeyDer) {
  const crxId = crypto.createHash('sha256').update(publicKeyDer).digest().subarray(0, 16);
  const alphabet = 'abcdefghijklmnop';
  return {
    crxId: crxId.toString('hex'),
    extensionId: [...crxId.toString('hex').slice(0, 32)]
      .map((c) => alphabet[parseInt(c, 16)])
      .join(''),
  };
}

export function verifyCrx(file) {
  const result = { file, ok: false, problems: [], info: {} };
  const buf = fs.readFileSync(file);

  if (buf.subarray(0, 4).toString('latin1') !== 'Cr24') {
    result.problems.push('文件头不是 Cr24');
    return result;
  }
  const version = buf.readUInt32LE(4);
  result.info.version = version;
  if (version !== 3) {
    result.problems.push(
      `CRX version = ${version}，Chromium 只接受 3（version 2 / 手工拼的头一律 ERROR_HEADER_INVALID，装不上）`
    );
    return result;
  }

  const headerLen = buf.readUInt32LE(8);
  const header = buf.subarray(12, 12 + headerLen);
  const archive = buf.subarray(12 + headerLen);
  result.info.headerLen = headerLen;
  result.info.archiveLen = archive.length;

  if (archive.subarray(0, 2).toString('latin1') !== 'PK') {
    result.problems.push('header 之后不是 zip（不是 PK 开头），结构损坏');
    return result;
  }

  const headerFields = parseFields(header);
  const proofField = headerFields.find((f) => f.field === 2);
  const signedDataField = headerFields.find((f) => f.field === 10000);
  if (!proofField || !signedDataField) {
    result.problems.push('CrxFileHeader 缺少 sha256_with_rsa(2) 或 signed_header_data(10000)');
    return result;
  }

  const proofFields = parseFields(proofField.value);
  const publicKey = proofFields.find((f) => f.field === 1)?.value;
  const signature = proofFields.find((f) => f.field === 2)?.value;
  const signedData = signedDataField.value;
  if (!publicKey || !signature) {
    result.problems.push('AsymmetricKeyProof 缺少 public_key(1) 或 signature(2)');
    return result;
  }

  const ids = extensionIdFromPublicKey(publicKey);
  const declared = parseFields(signedData).find((f) => f.field === 1)?.value;
  result.info.crxId = ids.crxId;
  result.info.extensionId = ids.extensionId;
  result.info.signedDataLen = signedData.length;
  result.info.signatureLen = signature.length;

  if (!declared || Buffer.compare(Buffer.from(ids.crxId, 'hex'), declared) !== 0) {
    result.problems.push('header 里声明的 crx_id 与公钥哈希不一致');
  }

  const key = crypto.createPublicKey({ key: publicKey, format: 'der', type: 'spki' });
  const tryVerify = (payload) =>
    crypto.verify('sha256', payload, { key, padding: crypto.constants.RSA_PKCS1_PADDING }, signature);

  const signatureOk = tryVerify(
    Buffer.concat([SIGNATURE_CONTEXT, le32(signedData.length), signedData, archive])
  );
  result.info.signatureOk = signatureOk;
  if (!signatureOk) {
    result.problems.push(
      '签名校验失败：签名不是按 LE32(len(signed_header_data)) + signed_header_data + archive 算的'
    );
    const variants = [
      {
        name: 'LE32(整个 CrxFileHeader 长度) + signed_header_data + archive',
        payload: Buffer.concat([SIGNATURE_CONTEXT, le32(header.length), signedData, archive]),
      },
      {
        name: 'LE32(整个 CrxFileHeader 长度) + 整个 CrxFileHeader + archive',
        payload: Buffer.concat([SIGNATURE_CONTEXT, le32(header.length), header, archive]),
      },
      { name: '完全没有长度字段', payload: Buffer.concat([SIGNATURE_CONTEXT, signedData, archive]) },
    ];
    for (const v of variants) {
      if (tryVerify(v.payload)) {
        result.info.matchedWrongScheme = v.name;
        result.problems.push(`实际签名用的载荷是：${v.name}`);
      }
    }
  }

  result.ok = result.problems.length === 0;
  return result;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('用法: node verify-crx.mjs <file.crx> [...]');
    process.exit(2);
  }
  let failed = 0;
  for (const file of files) {
    try {
      const r = verifyCrx(file);
      if (r.ok) {
        console.log(`✅ PASS  ${file}`);
        console.log(
          `     version=3 archive=${r.info.archiveLen}B 扩展ID=${r.info.extensionId} 签名=有效`
        );
      } else {
        failed += 1;
        console.log(`❌ FAIL  ${file}`);
        r.problems.forEach((p) => console.log(`     - ${p}`));
      }
    } catch (err) {
      failed += 1;
      console.log(`❌ FAIL  ${file}`);
      console.log(`     - 解析异常: ${err.message}`);
    }
  }
  process.exit(failed ? 1 : 0);
}
