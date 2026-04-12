import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import {
  collection,
  query,
  getDocs,
  type QueryConstraint,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Hook สำหรับดึงข้อมูลจาก Firestore แบบ Collection
 * @param queryKey - คีย์สำหรับ React Query Cache
 * @param collectionName - ชื่อ Collection ใน Firestore (เช่น 'students', 'grades')
 * @param constraints - เงื่อนไขการ Query (เช่น where, orderBy, limit)
 */
export function useFirestoreQuery<T = DocumentData>(
  queryKey: any[],
  collectionName: string,
  constraints: QueryConstraint[] = [],
  options?: UseQueryOptions<T[]>
) {
  return useQuery<T[]>({
    queryKey,
    queryFn: async () => {
      const colRef = collection(db, collectionName);
      const q = query(colRef, ...constraints);
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as T[];
    },
    ...options,
  });
}