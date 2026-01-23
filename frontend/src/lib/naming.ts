export function getUniqueName(name: string, existingNames: string[]): string {
    if (!existingNames.includes(name)) {
        return name;
    }

    const regex = /^(.*) \((\d+)\)$/;
    const match = name.match(regex);

    let baseName = name;
    let counter = 1;

    if (match) {
        baseName = match[1];
        counter = parseInt(match[2], 10) + 1;
    }

    let candidate = match ? `${baseName} (${counter})` : `${baseName} (${counter})`;

    while (existingNames.includes(candidate)) {
        counter++;
        candidate = `${baseName} (${counter})`;
    }

    return candidate;
}
