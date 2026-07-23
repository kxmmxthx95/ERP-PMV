import { HiArrowUpTray, HiPencilSquare, HiXMark } from 'react-icons/hi2'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  DRAWER_HEADER_ICON_BTN,
  DRAWER_HEADER_RIGHT_ACTIONS,
} from '@/lib/drawerHeaderBtn'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectCsv: () => void
  onSelectForm: () => void
  isMobile: boolean
}

function ChoiceButtons({
  onSelectCsv,
  onSelectForm,
}: {
  onSelectCsv: () => void
  onSelectForm: () => void
}) {
  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={onSelectCsv}
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors',
          'hover:bg-muted/40 active:scale-[0.99]',
        )}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <HiArrowUpTray className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-[14px] font-black text-foreground font-sukhumvit">
            นำเข้าจาก CSV
          </span>
          <span className="mt-0.5 block text-[12px] font-bold text-muted-foreground font-sukhumvit">
            อัปโหลดไฟล์ CSV / Excel
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={onSelectForm}
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors',
          'hover:bg-muted/40 active:scale-[0.99]',
        )}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <HiPencilSquare className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-[14px] font-black text-foreground font-sukhumvit">
            กรอกฟอร์ม
          </span>
          <span className="mt-0.5 block text-[12px] font-bold text-muted-foreground font-sukhumvit">
            เพิ่มนักเรียนทีละคน
          </span>
        </span>
      </button>
    </div>
  )
}

export default function StudentImportChooser({
  open,
  onOpenChange,
  onSelectCsv,
  onSelectForm,
  isMobile,
}: Props) {
  const pickCsv = () => {
    onOpenChange(false)
    onSelectCsv()
  }
  const pickForm = () => {
    onOpenChange(false)
    onSelectForm()
  }

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
        <DrawerContent className="font-sukhumvit pb-[max(1rem,env(safe-area-inset-bottom))]">
          <DrawerHeader className="px-4 pb-2">
            <div className="relative flex min-h-10 items-center justify-center">
              <DrawerTitle className="text-base font-black text-foreground">
                นำเข้านักเรียน
              </DrawerTitle>
              <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className={DRAWER_HEADER_ICON_BTN}
                  aria-label="ปิด"
                >
                  <HiXMark className="h-4 w-4" />
                </button>
              </div>
            </div>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <ChoiceButtons onSelectCsv={pickCsv} onSelectForm={pickForm} />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl font-sukhumvit sm:max-w-md">
        <DialogHeader className="pt-2 sm:pt-4">
          <DialogTitle className="text-lg font-black tracking-tight sm:text-xl">
            นำเข้านักเรียน
          </DialogTitle>
        </DialogHeader>
        <div className="px-1 pb-2">
          <ChoiceButtons onSelectCsv={pickCsv} onSelectForm={pickForm} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
