export function formatDateToUKDisplay(input) {
    if (!input) throw new Error("No date provided");

    const date = new Date(input);

    if (isNaN(date)) {
        throw new Error(`Invalid date: ${input}`);
    }

    const day = String(date.getDate()).padStart(2, "0");

    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
}

