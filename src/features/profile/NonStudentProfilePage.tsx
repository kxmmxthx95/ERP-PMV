import { useEffect, useState } from 'react';
import {
  HiUserCircle,
  HiShieldCheck,
  HiPhone,
  HiEnvelope,
  HiChatBubbleLeftRight,
  HiClipboardDocument,
  HiCheck,
} from 'react-icons/hi2';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS } from '@/types/mockUsers';
import { ProfileCard, ProfileRow, getInitials } from './profileLayoutShared';
import { LineConnectDialog } from './LineConnectDialog';

export default function NonStudentProfilePage() {
  const { user, userData, role } = useAuth();

  const [lineUid, setLineUid] = useState<string>((userData?.lineUid || userData?.lineToken || '').trim());
  const [lineModalOpen, setLineModalOpen] = useState(false);

  useEffect(() => {
    setLineUid((userData?.lineUid || userData?.lineToken || '').trim());
  }, [userData]);

  const displayName = userData?.firstName
    ? `${userData.prefix || ''}${userData.firstName} ${userData.lastName || ''}`.trim()
    : (user?.displayName || user?.email || 'ผู้ใช้งาน');

  const email = user?.email || userData?.email || '-';
  const photoURL = userData?.photoURL || user?.photoURL || '';
  const roleLabel = ROLE_LABELS[role || '']?.label || role || '-';
  const phone = userData?.phone || '-';

  function openLineModal() {
    if (lineUid) return;
    setLineModalOpen(true);
  }

  return (
    <>
      <div className="h-full w-full overflow-y-auto bg-white px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-lg space-y-5">
          <header className="flex flex-col items-center text-center pt-2 pb-1">
            <div className="relative">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={displayName}
                  className="h-24 w-24 rounded-full object-cover ring-4 ring-slate-100"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-100 text-2xl font-black text-slate-500 ring-4 ring-slate-50">
                  {getInitials(displayName)}
                </div>
              )}
            </div>
            <h1 className="mt-4 text-2xl font-black text-slate-900 break-words max-w-full">{displayName}</h1>
            <p className="mt-1 text-sm font-medium text-slate-400 break-all max-w-full">{email}</p>
          </header>

          <div id="account-section">
            <ProfileCard title="ข้อมูลบัญชี">
              <ProfileRow icon={<HiUserCircle className="h-5 w-5" />} label="ชื่อ-นามสกุล" value={displayName} />
              <ProfileRow icon={<HiShieldCheck className="h-5 w-5" />} label="บทบาท" value={roleLabel} />
              <ProfileRow icon={<HiEnvelope className="h-5 w-5" />} label="อีเมล" value={email} />
              <ProfileRow icon={<HiPhone className="h-5 w-5" />} label="เบอร์โทร" value={phone} />
            </ProfileCard>
          </div>

          <ProfileCard title="การตั้งค่า">
            <ProfileRow
              icon={<HiChatBubbleLeftRight className="h-5 w-5" />}
              label="LINE Official"
              onClick={lineUid ? undefined : openLineModal}
              trailing={
                lineUid ? (
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#06c755] text-white shadow-sm"
                    aria-label="เชื่อม LINE แล้ว"
                    title="เชื่อม LINE แล้ว"
                  >
                    <HiCheck className="h-4 w-4" strokeWidth={2.5} />
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-[#06c755] px-2.5 py-0.5 text-[11px] font-black text-white">
                    เชื่อม LINE
                  </span>
                )
              }
            />
            <ProfileRow
              icon={<HiClipboardDocument className="h-5 w-5" />}
              label="รหัสผู้ใช้"
              value={user?.uid ? `${user.uid.slice(0, 8)}…` : '-'}
            />
          </ProfileCard>
        </div>
      </div>

      <LineConnectDialog open={lineModalOpen} onOpenChange={setLineModalOpen} />
    </>
  );
}
