import { NgModule } from '@angular/core';
import { configureTstdl } from '@tstdl/base';
import { ColoredProgressbarComponent, IndeterminateProgressBarComponent, SkeletonComponent } from './components';
import { AutoForDirective, AutoIdDirective, InputPatternDirective, LazyDirective, LazyListDirective, LetDirective, RepeatDirective, VisibilityObserverDirective } from './directives';
import { DateTimeLocalePipe, DateTimePipe, DateTimeToDatePipe, DecyclePipe, DurationPipe, DynamicTextPipe, LocalizeEnumPipe, LocalizePipe, NumberLocalePipe, NumericDateToDateTimePipe, NumericTimeToDateTimePipe, OptionalLocalizePipe, PadPipe, SafeHtmlPipe, SafeResourceUrlPipe, SafeUrlPipe, SerializePipe } from './pipes';
import { SignalPipe } from './pipes/signal.pipe';
import { TstdlBridgeService } from './services/tstdl-bridge.service';

const pipes = [
  DateTimeLocalePipe,
  DateTimePipe,
  DateTimeToDatePipe,
  DecyclePipe,
  DurationPipe,
  DynamicTextPipe,
  LocalizeEnumPipe,
  LocalizePipe,
  NumberLocalePipe,
  NumericDateToDateTimePipe,
  NumericTimeToDateTimePipe,
  OptionalLocalizePipe,
  PadPipe,
  SafeHtmlPipe,
  SafeResourceUrlPipe,
  SafeUrlPipe,
  SerializePipe,
  SignalPipe
];

const directives = [
  AutoForDirective,
  AutoIdDirective,
  InputPatternDirective,
  LazyDirective,
  LazyListDirective,
  LetDirective,
  RepeatDirective,
  VisibilityObserverDirective
];

const components = [
  SkeletonComponent,
  IndeterminateProgressBarComponent,
  ColoredProgressbarComponent
];

const declarations = [
  ...pipes,
  ...directives,
  ...components
];

@NgModule({
  imports: declarations,
  exports: declarations
})
export class TstdlAngularModule {
  constructor(bridge: TstdlBridgeService) {
    configureTstdl();
    bridge.initialize();
  }
}
