import { NgModule } from '@angular/core';
import { SkeletonComponent } from './components';
import { AutoForDirective, AutoIdDirective, InputPatternDirective, LazyDirective, LazyListDirective, LetDirective, RepeatDirective, VisibleObserverDirective } from './directives';
import { DateTimeLocalePipe, DateTimePipe, DateTimeToDatePipe, DurationPipe, LocalizePipe, NumberLocalePipe, NumericDateToDateTimePipe, OptionalLocalizePipe, PadPipe, SafeUrlPipe, TimestampToDateTimePipe } from './pipes';
import { TstdlBridgeService } from './services/tstdl-bridge.service';

const declarations = [
  AutoForDirective,
  AutoIdDirective,
  DateTimeLocalePipe,
  DateTimePipe,
  DateTimeToDatePipe,
  DurationPipe,
  InputPatternDirective,
  LazyDirective,
  LazyListDirective,
  LetDirective,
  LocalizePipe,
  NumberLocalePipe,
  NumericDateToDateTimePipe,
  OptionalLocalizePipe,
  PadPipe,
  RepeatDirective,
  SafeUrlPipe,
  SkeletonComponent,
  TimestampToDateTimePipe,
  VisibleObserverDirective
];

@NgModule({
  declarations,
  exports: declarations
})
export class TstdlAngularModule {
  constructor(bridge: TstdlBridgeService) {
    bridge.initialize();
  }
}
