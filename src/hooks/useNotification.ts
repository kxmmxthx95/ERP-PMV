import { toast } from "sonner";
import { addDoc, collection, serverTimestamp, updateDoc, doc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./useAuth";

export const useNotification = () => {
  const { user } = useAuth();

  /**
   * 1. UI Feedback - แจ้งเตือนภายในแอป
   */
  const notify = {
    success: (message: string) => toast.success(message),
    error: (message: string) => toast.error(message),
    info: (message: string) => toast.info(message),
  };

  /**
   * 2. System Notification - ส่งประกาศลง Database
   * อ้างอิงตาม Schema: targetRoles, type, title, body
   */
  const sendSystemNotification = async (data: {
    title: string;
    body: string;
    type: "announcement" | "grade" | "alert";
    targetRoles: string[];
    targetUIDs?: string[];
  }) => {
    try {
      if (!user) throw new Error("Unauthorized");

      await addDoc(collection(db, "notifications"), {
        ...data,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        readBy: [], // เก็บ UID ของคนที่อ่านแล้ว
      });

      notify.success("ส่งการแจ้งเตือนสำเร็จ");
    } catch (error) {
      notify.error("ไม่สามารถส่งแจ้งเตือนได้");
      console.error(error);
    }
  };

  /**
   * 3. Mark as Read - บันทึกว่าผู้ใช้อ่านแล้ว
   */
  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    try {
      const notifRef = doc(db, "notifications", notificationId);
      await updateDoc(notifRef, {
        readBy: arrayUnion(user.uid)
      });
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  return { notify, sendSystemNotification, markAsRead };
};