"use client";

import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { BrandMark } from "@/components/Chrome";
import { PLATFORM_CONFIGS, PLATFORM_GROUPS } from "@/lib/rubrics";
import type { Platform } from "@/lib/schemas";

// The studio's platform picker, grouped like the home page. A Base UI Select instead of a native
// <select>: Safari opens a native menu over the control (so it pops upward), while this one always
// opens below the trigger (alignItemWithTrigger={false}).

export function PlatformSelect(props: {
  value: Platform;
  disabled?: boolean;
  onChange: (platform: Platform) => void;
}) {
  const { value, disabled, onChange } = props;
  return (
    <Select.Root value={value} disabled={disabled} onValueChange={(next) => next && onChange(next as Platform)}>
      <Select.Trigger className="tour-platform-select" aria-label="Platform">
        <BrandMark platform={value} />
        <Select.Value>{(v: Platform) => PLATFORM_CONFIGS[v].label}</Select.Value>
        <Select.Icon className="tour-platform-chevron">
          <ChevronDown size={14} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className="platform-menu-positioner" alignItemWithTrigger={false} sideOffset={6} align="end">
          <Select.Popup className="platform-menu">
            {PLATFORM_GROUPS.map((g) => (
              <Select.Group key={g.group} className="platform-menu-group">
                <Select.GroupLabel className="platform-menu-label">{g.label}</Select.GroupLabel>
                {g.platforms.map((id) => (
                  <Select.Item key={id} value={id} className="platform-menu-item">
                    <span className="platform-menu-logo" data-platform={id}>
                      <BrandMark platform={id} />
                    </span>
                    <Select.ItemText>{PLATFORM_CONFIGS[id].label}</Select.ItemText>
                    <Select.ItemIndicator className="platform-menu-check">
                      <Check size={14} />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Group>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
