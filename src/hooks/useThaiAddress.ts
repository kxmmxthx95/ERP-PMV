import { useState, useEffect } from 'react';

export interface ThaiAddress {
  district: string;
  amphoe: string;
  province: string;
  zipcode: number;
  district_code: number;
  amphoe_code: number;
  province_code: number;
}

export function useThaiAddress() {
  const [data, setData] = useState<ThaiAddress[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch('https://raw.githubusercontent.com/earthchie/jquery.Thailand.js/master/jquery.Thailand.js/database/raw_database/raw_database.json');
        if (!response.ok) {
          throw new Error(`Thai address request failed (${response.status})`);
        }

        // Parse as text first to guard against HTML/error pages returned by proxies/CDNs.
        const raw = await response.text();
        const trimmed = raw.trim();
        if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
          throw new Error('Thai address endpoint returned HTML instead of JSON');
        }

        const parsed = JSON.parse(trimmed) as unknown;
        if (!Array.isArray(parsed)) {
          throw new Error('Thai address payload is not an array');
        }

        setData(parsed as ThaiAddress[]);
      } catch (error) {
        console.error('Failed to fetch Thai address DB:', error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const searchAddress = (keyword: string) => {
    if (!keyword || keyword.trim() === '') return [];
    
    // Limit to top 20 results for performance
    const results: ThaiAddress[] = [];
    const kw = keyword.toLowerCase().trim();
    
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (
        item.district.includes(kw) ||
        item.amphoe.includes(kw) ||
        item.province.includes(kw) ||
        item.zipcode.toString().includes(kw)
      ) {
        results.push(item);
        if (results.length >= 20) break;
      }
    }
    
    return results;
  };

  return { data, loading, searchAddress };
}
