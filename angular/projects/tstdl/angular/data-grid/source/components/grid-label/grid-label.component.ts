import type { TemplateRef } from '@angular/core';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';
import type { DynamicText } from '@tstdl/base/text';

@Component({
  selector: 'tsl-grid-label',
  templateUrl: './grid-label.component.html',
  styleUrls: ['./grid-label.component.scss'],
  changeDetection: ChangeDetectionStrategy.Default,
  host: {
    '[class.tsl-text-sm]': 'true',
    '[class.tsl-leading-4]': 'true',
    '[class.tsl-font-semibold]': 'true'
  }
})
export class GridLabelComponent {
  @Input() label: DynamicText | null | undefined;
  @Input() templateRef: TemplateRef<void> | null | undefined;
  @Input() colon: boolean;

  constructor(_changeDetector: ChangeDetectorRef) {
    this.colon = false;
  }
}
