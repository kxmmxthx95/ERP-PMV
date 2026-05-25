import React, { useState, useRef, useEffect } from 'react';
import { useThaiAddress } from '@/hooks/useThaiAddress';
import type { ThaiAddress } from '@/hooks/useThaiAddress';

interface Props {
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
  onChange: (updates: {
    subdistrict: string;
    district: string;
    province: string;
    postalCode: string;
  }) => void;
  isEditMode: boolean;
  viewCls: string;
  inputCls: string;
}

const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1 relative">
    <label className="text-[12px] font-black text-slate-700">
      {label}
    </label>
    {children}
  </div>
);

export function ThaiAddressInputGroup({
  subdistrict, district, province, postalCode,
  onChange, isEditMode, viewCls, inputCls
}: Props) {
  const { searchAddress } = useThaiAddress();
  const [suggestions, setSuggestions] = useState<ThaiAddress[]>([]);
  const [activeField, setActiveField] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSuggestions([]);
        setActiveField(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (field: string, val: string) => {
    onChange({
      subdistrict: field === 'subdistrict' ? val : subdistrict,
      district: field === 'district' ? val : district,
      province: field === 'province' ? val : province,
      postalCode: field === 'postalCode' ? val : postalCode,
    });
    
    setActiveField(field);
    if (val.length > 1) {
      setSuggestions(searchAddress(val));
    } else {
      setSuggestions([]);
    }
  };

  const handleSelect = (addr: ThaiAddress) => {
    onChange({
      subdistrict: addr.district,
      district: addr.amphoe,
      province: addr.province,
      postalCode: addr.zipcode.toString(),
    });
    setSuggestions([]);
    setActiveField(null);
  };

  if (!isEditMode) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <F label="ตำบล/แขวง"><div className={viewCls}>{subdistrict || '-'}</div></F>
        <F label="อำเภอ/เขต"><div className={viewCls}>{district || '-'}</div></F>
        <F label="จังหวัด"><div className={viewCls}>{province || '-'}</div></F>
        <F label="รหัสไปรษณีย์"><div className={viewCls}>{postalCode || '-'}</div></F>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative" ref={containerRef}>
      <F label="ตำบล/แขวง">
        <input
          value={subdistrict}
          onChange={e => handleChange('subdistrict', e.target.value)}
          className={inputCls}
          placeholder="ตำบล..."
          onFocus={() => {
             if (subdistrict.length > 1) {
               setSuggestions(searchAddress(subdistrict));
               setActiveField('subdistrict');
             }
          }}
        />
      </F>
      <F label="อำเภอ/เขต">
        <input
          value={district}
          onChange={e => handleChange('district', e.target.value)}
          className={inputCls}
          placeholder="อำเภอ..."
          onFocus={() => {
             if (district.length > 1) {
               setSuggestions(searchAddress(district));
               setActiveField('district');
             }
          }}
        />
      </F>
      <F label="จังหวัด">
        <input
          value={province}
          onChange={e => handleChange('province', e.target.value)}
          className={inputCls}
          placeholder="จังหวัด..."
          onFocus={() => {
             if (province.length > 1) {
               setSuggestions(searchAddress(province));
               setActiveField('province');
             }
          }}
        />
      </F>
      <F label="รหัสไปรษณีย์">
        <input
          value={postalCode}
          onChange={e => handleChange('postalCode', e.target.value)}
          className={inputCls}
          placeholder="รหัสไปรษณีย์..."
          onFocus={() => {
             if (postalCode.length > 1) {
               setSuggestions(searchAddress(postalCode));
               setActiveField('postalCode');
             }
          }}
        />
      </F>

      {/* Autocomplete Dropdown */}
      {suggestions.length > 0 && activeField && (
        <div className="absolute top-full left-0 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-50 divide-y divide-slate-100">
          {suggestions.map((addr, i) => (
            <div
              key={i}
              className="px-4 py-2 cursor-pointer hover:bg-blue-50 transition-colors flex items-center justify-between group"
              onClick={() => handleSelect(addr)}
            >
              <div className="flex gap-2 text-[13px]">
                <span className="font-bold text-slate-800">ต.{addr.district}</span>
                <span className="text-slate-500">อ.{addr.amphoe}</span>
                <span className="text-slate-500">จ.{addr.province}</span>
              </div>
              <span className="text-[12px] font-bold text-blue-600 bg-blue-50 group-hover:bg-blue-100 px-2 py-0.5 rounded">
                {addr.zipcode}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
