import { mkdir, writeFile, readFile } from 'node:fs/promises';
import PDFDocument from 'pdfkit';
const escape = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export async function courses(catalogue) {
  await mkdir('dist/cours', {recursive:true});
  for (const c of catalogue.chapitres) {
    const paragraphs = [c.objectif,c.intro,...c.essentiel,c.approfondissement,c.question,c.petitPas];
    const notice = 'Support de préparation du prototype : adaptation de travail à valider par l’équipe pédagogique. Ce support reprend uniquement le contenu versionné dans le catalogue ; il ne remplace pas le cours original.';
    await writeFile(`dist/cours/${c.id}.html`, `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="referrer" content="no-referrer"><title>${escape(c.titre)}</title><link rel="stylesheet" href="/carnet.css"></head><body><main class="support-cours"><a href="/">Revenir au carnet</a><h1>${escape(c.titre)}</h1><p>${escape(notice)}</p>${paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}<p>${escape(c.statutLecture)}</p><a download href="/cours/${c.id}.pdf">Télécharger en PDF</a></main></body></html>`);
    const doc = new PDFDocument({size:'A4',margin:50,info:{Title:c.titre,Author:'ETP vie affective',CreationDate:new Date('2026-10-25T00:00:00Z'),ModDate:new Date('2026-10-25T00:00:00Z')}});
    const chunks=[];const ready=new Promise((resolve,reject)=>{doc.on('data',c=>chunks.push(c));doc.on('end',resolve);doc.on('error',reject);});
    doc.font('Helvetica-Bold').fontSize(20).text(c.titre).moveDown();
    doc.font('Helvetica').fontSize(10).text(notice).moveDown();
    for(const p of paragraphs) doc.fontSize(12).text(p).moveDown();
    doc.fontSize(9).text(c.statutLecture);doc.end();await ready;
    await writeFile(`dist/cours/${c.id}.pdf`,Buffer.concat(chunks));
  }
}
