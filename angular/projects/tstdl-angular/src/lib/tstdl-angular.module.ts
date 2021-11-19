import { NgModule } from '@angular/core';
import { LazyListDirective, VisibleObserverDirective } from './directives';
import { LetDirective } from './directives/let.directive';
import { DateTimeLocalePipe, DateTimePipe, DateTimeToDatePipe, DurationPipe, LocalizePipe, NumericDateToDateTimePipe, OptionalLocalizePipe, PadPipe, SafeUrlPipe, TimestampToDateTimePipe } from './pipes';

const declarations = [
  DateTimeLocalePipe,
  DateTimePipe,
  DateTimeToDatePipe,
  DurationPipe,
  LazyListDirective,
  LetDirective,
  LocalizePipe,
  OptionalLocalizePipe,
  NumericDateToDateTimePipe,
  PadPipe,
  SafeUrlPipe,
  TimestampToDateTimePipe,
  VisibleObserverDirective
];

@NgModule({
  declarations,
  exports: declarations
})
export class TstdlAngularModule { }
