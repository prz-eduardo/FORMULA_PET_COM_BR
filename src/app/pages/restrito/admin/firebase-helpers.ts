import { db } from '../../../firebase-config';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';

// Pega todos os itens de uma coleção
export async function getCollectionItems(colName: string) {
  const colRef = collection(db, colName);
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Adiciona item a uma coleção
export async function addCollectionItem(colName: string, name: string) {
  const colRef = collection(db, colName);
  await addDoc(colRef, { name });
}

// Deleta item da coleção
export async function deleteCollectionItem(colName: string, id: string) {
  await deleteDoc(doc(db, colName, id));
}
