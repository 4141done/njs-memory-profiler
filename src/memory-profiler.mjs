const TAG = "memSnapshot";

function init(r) {
  r.variables.profiler_memory_start = serialize(njs.memoryStats);
  r.variables.profiler_memory_cluster_size = njs.memoryStats.cluster_size;
  r.variables.profiler_memory_page_size = njs.memoryStats.page_size;
}

function snapshot(r) {
  return serialize(njs.memoryStats);
}


function serialize(name, memoryStats) {
  return `${TAG}:${memoryStats.size || "."}:${memoryStats.nblocks || "."}`;
}

function deserialize(str) {
  const parts = str.split(":")
  if(parts[0] !== TAG) throw "deserialize: expected: ${TAG}, got: ${parts[0]}";
  
  return {
    size: parseInt(parts[1], 10),
    nblocks: parseInt(parts[2], 10)
  };
}

export default { init, snapshot, serialize, deserialize };


