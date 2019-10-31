
function eliminateDuplicates<T>(...values: T[]): T[]
{
    // Check for duplicates here!
    
    return values;
}


// TODO: Set<???> does NOT ensure unique objects!
//       See: https://stackoverflow.com/a/29759699
//       Thus - build a sorted array, that don't allow duplicates.
export class UniqueArray<Type> extends Array<Type>
{
    constructor(...values: Type[])
    {
        super( ...eliminateDuplicates(...values) );
    }
    
    public add(...values: Type[])
    {
        // Check for duplicates here!
        super.push(...values);
    }
}
