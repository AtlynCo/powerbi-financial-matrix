import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

class StatementCard extends formattingSettings.SimpleCard {
    name = "statement";
    displayNameKey = "Card_Statement";
    lines = new formattingSettings.TextArea({
        name: "lines", displayNameKey: "Setting_Lines", value: "[]", placeholder: '[{"id":"revenue",...}]'
    });
    variances = new formattingSettings.ToggleSwitch({
        name: "variances", displayNameKey: "Setting_Variances", value: true
    });
    direction = new formattingSettings.ToggleSwitch({
        name: "direction", displayNameKey: "Setting_Direction", value: false
    });
    slices = [this.lines, this.variances, this.direction];
}

export class Settings extends formattingSettings.Model {
    statement = new StatementCard();
    cards = [this.statement];
}
